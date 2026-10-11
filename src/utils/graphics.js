export function getGraphicsProfile(environment = globalThis.navigator ?? {}) {
  const cores = Number(environment.hardwareConcurrency) || 0;
  const memory = Number(environment.deviceMemory) || 0;
  const lowPower = (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);

  return {
    lowPower,
    maxPixelRatio: lowPower ? 1 : 1.4,
    antialias: !lowPower,
    shadowMapSize: lowPower ? 512 : 1024,
    shadowMapType: lowPower ? 'basic' : 'soft',
  };
}
