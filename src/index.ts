import * as d3 from 'd3';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SVGOptim from 'svgo';
import * as topojson from 'topojson';

// optimize paths
const svgo = new SVGOptim({
    plugins: [{
        convertPathData: true,
        transformsWithOnePath: true
    }]
});