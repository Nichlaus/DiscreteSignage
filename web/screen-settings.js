export const orientations = {
  landscape: 0, portrait: 90, 'landscape-flipped': 180, 'portrait-flipped': 270,
};
export const scaleTypes = { fit: 'contain', fill: 'cover', stretch: 'fill' };

export function applyScreenSettings(stage, settings) {
  if (!Object.hasOwn(orientations, settings.orientation) || !Object.hasOwn(scaleTypes, settings.scaleType)
    || !Number.isSafeInteger(settings.version) || settings.version < 1) throw Error('Unsupported settings');
  const degrees = orientations[settings.orientation];
  const portrait = degrees % 180 !== 0;
  stage.style.width = portrait ? '100vh' : '100vw';
  stage.style.height = portrait ? '100vw' : '100vh';
  stage.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
  stage.style.setProperty('--media-fit', scaleTypes[settings.scaleType]);
}
