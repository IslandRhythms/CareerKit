import { CareerKitApi } from '../shared/types';

declare global {
  interface Window {
    careerkit: CareerKitApi;
  }
}

export {};
