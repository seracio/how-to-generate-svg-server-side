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
const simplifiedTopology = topojson.simplify(presimplifiedTopology, .0001);

// mapping with communes and departements
const mapping: Array<Object> = readCSV('data/Table_de_correspondance_circo_legislatives2017-1.csv');
const mappingDOM: Object = {
    'ZA': '971',
    'ZB': '972',
    'ZC': '973',
    'ZD': '974',
    'ZM': '976',
};

