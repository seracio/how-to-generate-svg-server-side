import * as React from 'react';

interface Props {
    features: Array<Object>,
    labels: Array<string>,
    uris: Array<string>,
    ids: Array<string>,
    pathGen: (feature: Object) => string
}

const Features = ({ features, labels, uris, ids, pathGen }: Props) => {
    return (
        <g>
            {features.map((feature, index) => {
                const uri = uris[index];
                const label = labels[index];
                const id = ids[index];
                return (
                    <a xlinkHref={uri} key={index} >
                        <path className="eln-map__children"
                            style={{ fill: 'rgba(0,0,0,0)', stroke: "red" }}
                            d={pathGen(feature)}
                            data-id={id}
                            data-label={label} />
                    </a>
                );
            })}
        </g>
    );
};

export default Features;
