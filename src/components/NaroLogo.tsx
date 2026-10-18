import React from 'react';
import { HyperMeloLogo, type HyperMeloLogoProps } from './HyperMeloLogo';

export type NaroLogoProps = HyperMeloLogoProps;

/**
 * Backwards compatibility export:
 * NaroLogo now renders the unified HyperMelo brand identity.
 */
export const NaroLogo: React.FC<NaroLogoProps> = (props) => {
  return <HyperMeloLogo {...props} />;
};

export { HyperMeloLogo };
