import * as assert from 'assert';
import * as d3 from 'd3';
import { writeFileSync } from 'filendir';
import * as fs from 'fs';
import * as _ from 'lodash/fp';
import * as topojson from 'topojson';

// Helpers
const readJSON: (filename: string) => any = _.flow(fs.readFileSync, JSON.parse);
const readCSV: (filename: string) => Array<Object> = _.flow(
    filename => fs.readFileSync(filename, 'utf-8'),
    d3.dsvFormat(';').parse
);
const mapValuesWithKey = _.mapValues.convert({ cap: false });
const format2: (string) => string = _.flow(
    parseInt,
    d3.format('02'),
    str => str.slice(-2)
);
const format3: (string) => string = _.flow(
    parseInt,
    d3.format('03'),
    str => str.slice(-3)
);

// generate a lightweight topology
const originalGeojson = readJSON('data/circonscriptions-legislatives.json');
const features: Array<Object> = _.flow(
    _.get('features'),
    // regroup by id circo:
    // there is something strange on the original file,
    // as there are several objects for the same circo : 976-01 or 976-02 for instance
    // let's regroup them
    _.groupBy(_.get('properties.REF')),
    mapValuesWithKey((features: Array<Object>, key: string) => {
        // trivial  case
        if (features.length === 1) {
            return features[0];
        }
        // else, we have to build a new feature by merging 
        const topology = topojson.topology(features);
        const geometry = topojson.merge(topology, _.values(topology.objects));
        return {
            type: 'Feature',
            geometry,
            properties: { REF: key }
        };
    }),
    _.values,
    // let's also remove features COM and foreign features
    _.filter(_.flow(
        _.get('properties.REF'),
        ref => parseInt(ref.slice(0, 3)),
        codeDept => codeDept <= 976 && codeDept !== 975,
    ))
)(originalGeojson);

// let's simplify throught topojson
const originalTopology = topojson.topology(features, 1e6);
const presimplifiedTopology = topojson.presimplify(originalTopology);
const simplifiedTopology = topojson.simplify(presimplifiedTopology, 1e-4);

/////////////////////////////////////
// WELCOME TO THE HELL OF MAPPING /o\
/////////////////////////////////////

// mapping with communes and departements
const mappingDOM = {
    'ZA': '971',
    'ZB': '972',
    'ZC': '973',
    'ZD': '974',
    'ZM': '976',
};
const mappingCorsica = {
    '2A': '02A',
    '2B': '02B'
};
const propertiesByRef: Object = _.flow(
    readCSV,
    // group by circonscription
    _.groupBy(line => {
        const codeDept = line['CODE DPT'];
        const codeCirconscription = line['CODE CIRC LEGISLATIVE'];
        // DOM
        if (_.has(codeDept, mappingDOM)) {
            return `${mappingDOM[codeDept]}-${format2(codeCirconscription)}`;
        }
        // Corsica
        if (_.has(codeDept, mappingCorsica)) {
            return `${mappingCorsica[codeDept]}-${format2(codeCirconscription)}`;
        }
        // Metropole
        if (!_.isNaN(parseInt(codeDept))) {
            return `${format3(codeDept)}-${format2(codeCirconscription)}`;
        }
        // others
        return 'others';
    }),
    // clean this mess to generate clean properties
    _.mapValues((lines: Array<Object>) => {
        const codeCirconscription: string = _.flow(
            _.map(_.get('CODE CIRC LEGISLATIVE')),
            _.uniq,
            _.first,
        )(lines);
        const codesCommune: Array<string> = _.flow(
            _.map(_.get('CODE COMMUNE')),
            _.uniq,
        )(lines);
        const codeDept: string = _.flow(
            _.map(_.get('CODE DPT')),
            _.uniq,
            _.first,
        )(lines);

        // DOM
        // code circo are 5 chars long
        // code communes are 3 char for the dept and 2 for the commune
        if (_.has(codeDept, mappingDOM)) {
            return {
                id: `${mappingDOM[codeDept]}${format2(codeCirconscription)}`,
                communes: codesCommune.map(codeCommune => `${mappingDOM[codeDept]}${format2(codeCommune)}`),
                departement: mappingDOM[codeDept],
            }
        }
        // Corsica
        // code circo are 4 chars long
        // code communes are 2 char for the dept and 3 for the commune
        if (_.has(codeDept, mappingCorsica)) {
            return {
                id: `${codeDept}${format2(codeCirconscription)}`,
                communes: codesCommune.map(codeCommune => `${codeDept}${format3(codeCommune)}`),
                departement: codeDept,
            };
        }
        // Metropole
        // code circo are 4 chars long
        // code communes are 2 char for the dept and 3 for the commune
        if (!_.isNaN(parseInt(codeDept))) {
            return {
                id: `${format2(codeDept)}${format2(codeCirconscription)}`,
                communes: codesCommune.map(codeCommune => `${format2(codeDept)}${format3(codeCommune)}`),
                departement: format2(codeDept),
            }
        }
        // else, we don't really care 
    })
)('data/Table_de_correspondance_circo_legislatives2017-1.csv');

// generate our geojsn features enhanced with clean properties
const enhancedFeatures: Array<any> = _.flow(
    _.get('objects'),
    _.mapValues(object => {
        const ref = _.get('properties.REF', object);
        const properties = propertiesByRef[ref];
        assert(!!properties, 'properties should be defined ' + ref);
        const feature = topojson.feature(simplifiedTopology, object);
        return {
            ...feature,
            properties,
        };
    }),
    _.values,
)(simplifiedTopology);


enhancedFeatures.forEach(feature => {
    const filename = feature.properties.id;
    writeFileSync(`data/circonscriptions/${filename}.json`, JSON.stringify(feature));
});
