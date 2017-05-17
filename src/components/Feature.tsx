import * as React from 'react';
import { ExtendedFeature } from '@types/d3';

interface Props {
    feature: ExtendedFeature<any, any>,
    pathGen: (feature: any) => string
}

export const Feature = ({ feature, pathGen }: Props) => {
    return (
        <a xlinkHref={'/'}>
            <path
                className="eln-map__children"
                strokeLinejoin="round"
                style={{ fill: 'blue', stroke: 'red', strokeWidth: .5 }}
                d={pathGen(feature)} />
        </a>

    );
};
