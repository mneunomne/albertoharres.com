const COLOR_MODE_FALLBACK = 'dark'
const CAMERA_FOV = 50
const IMAGE_SCALE = 35
const CANVAS_OUT_MARGIN = 200
const CAMERA_DISTANCE = 90
const CAMERA_ANIMATION_DURATION = 2000

const convertSizeValues = (ratio) => {
  var canvasHeight = getCanvasHeight(window);
  var vFOV = (CAMERA_FOV * Math.PI) / 180;
  var height = 2 * Math.tan(vFOV / 2) * CAMERA_DISTANCE; // visible height
  var objectHeight = h;
  var objectHeightOnScreen = (objectHeight / height) * canvasHeight; // visible height
  // return objectHeightOnScreen;
  var objectWidthOnScreen = objectHeightOnScreen * objectRatio;
}

const getImageHeightOnScreen = () => {
  var canvasHeight = getCanvasHeight(window);
  var vFOV = (CAMERA_FOV * Math.PI) / 180;
  var visibleHeight = 2 * Math.tan(vFOV / 2) * CAMERA_DISTANCE; // visible height
  var height = IMAGE_SCALE
  var objectHeightOnScreen = (height / visibleHeight) * canvasHeight;
  return objectHeightOnScreen
}

const getImageSizeOnScreen = (img_src) => new Promise((res, rej) => {
  var canvasHeight = getCanvasHeight(window);
  var vFOV = (CAMERA_FOV * Math.PI) / 180;
  var visibleHeight = 2 * Math.tan(vFOV / 2) * CAMERA_DISTANCE; // visible height
  var width, height = 0;
  // load image
  var img = new Image();
  img.src = img_src;
  // on load
  if (img.complete) {
    // update to correct aspect ratio
    const aspect = img.width / img.height;
    width = IMAGE_SCALE * aspect
    height = IMAGE_SCALE
    var objectHeightOnScreen = (height / visibleHeight) * canvasHeight;
    var objectWidthOnScreen = objectHeightOnScreen * aspect;
    res({ width: objectWidthOnScreen, height: objectHeightOnScreen })
  } else {
    img.onload = () => {
      // update to correct aspect ratio
      const aspect = img.width / img.height;
      width = IMAGE_SCALE * aspect
      height = IMAGE_SCALE
      var objectHeightOnScreen = (height / visibleHeight) * canvasHeight;
      var objectWidthOnScreen = objectHeightOnScreen * aspect;
      res({ width: objectWidthOnScreen, height: objectHeightOnScreen })
      //node.__threeObj.children[0].material.map.needsUpdate = true; // update texture
    };
  }
})

const getCanvasHeight = (_window) => {
  return _window.innerHeight + (CANVAS_OUT_MARGIN * 2)
}

const getContentMargin = (_window) => {
  var contentMargin = (_window.innerHeight - getImageHeightOnScreen()) / 2 - 150;
  return contentMargin
}


export { getImageSizeOnScreen, getCanvasHeight, getContentMargin, getImageHeightOnScreen, IMAGE_SCALE, CAMERA_FOV, CAMERA_DISTANCE, CANVAS_OUT_MARGIN, CAMERA_ANIMATION_DURATION }