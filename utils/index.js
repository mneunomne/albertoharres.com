const COLOR_MODE_FALLBACK = 'dark'
const CAMERA_FOV = 50
const IMAGE_SCALE = 35
const CANVAS_OUT_MARGIN = 150
const CAMERA_DISTANCE = 75

const getImageHeightOnScreen = () => {
  var canvasHeight = window.innerHeight + CANVAS_OUT_MARGIN;
  var vFOV = (CAMERA_FOV * Math.PI) / 180;
  var height = 2 * Math.tan(vFOV / 2) * CAMERA_DISTANCE; // visible height
  var objectHeight = IMAGE_SCALE;
  var objectHeightOnScreen = (objectHeight / height) * canvasHeight; // visible height
  return objectHeightOnScreen;
}

export { getImageHeightOnScreen, IMAGE_SCALE, CAMERA_FOV, CAMERA_DISTANCE, CANVAS_OUT_MARGIN }