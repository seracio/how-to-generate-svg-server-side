import * as d3 from 'd3';
import { writeFileSync } from 'filendir';
import * as fs from 'fs';
import * as glob from 'glob';
import * as _ from 'lodash/fp';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as SVGOptim from 'svgo';
import * as topojson from 'topojson';
import { GeoGeometryObjects, ExtendedFeature, GeoProjection } from '@types/d3';
import { Feature } from './components/Feature';

// optimize paths
const svgo = new SVGOptim({
    plugins: [{
        convertPathData: true,
        transformsWithOnePath: true
    }]
});

// helpers
const readJSON = _.flow(fs.readFileSync, JSON.parse);
const isMetropole = _.flow(
    _.get('properties.departement'),
    idDept => idDept.slice(0, 2) !== '97'
);

// TODO manage filtrer here 
const [, , filter] = process.argv;

(async function main() {
    // sizes
    const size = 500;
    // retrieve features
    const features: Array<ExtendedFeature<any, any>> = _.flow(
        glob.sync.bind(glob),
        _.map(readJSON),
        _.filter(isMetropole)
    )('data/circonscriptions/*.json');
    // geometeries
    const geometries: Array<GeoGeometryObjects> = _.map(_.get('geometry'), features);
    // projection 
    const projection: GeoProjection = d3.geoMercator()
        .fitExtent([[0, 0], [size, size]], {
            type: 'GeometryCollection',
            geometries,
        })
        .precision(1);
    // path generator
    const pathGen = d3.geoPath().projection(projection);
    const markup = renderToStaticMarkup(
        <svg
            viewBox={`0 0 ${size} ${size}`}
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink">
            {features.map((feature, index) => {
                return (<Feature
                    feature={feature}
                    key={index}
                    pathGen={pathGen} />);
            })}
        </svg>
    );

    const { data: html, error, info } = await new Promise<{ data, error, info }>(res => svgo.optimize(markup, res));
    if (!!error) {
        console.error('svgo optimization failed', error);
        process.exit(1);
    }
    writeFileSync('test.html', html);

}());

