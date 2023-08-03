const COLOR_MODE_FALLBACK = 'dark'
const CAMERA_FOV = 50
const IMAGE_SCALE = 35
const CANVAS_OUT_MARGIN = 200
const CAMERA_DISTANCE = 90

const convertSizeValues = (ratio) => {
  var canvasHeight = window.innerHeight + CANVAS_OUT_MARGIN;
  var vFOV = (CAMERA_FOV * Math.PI) / 180;
  var height = 2 * Math.tan(vFOV / 2) * CAMERA_DISTANCE; // visible height
  var objectHeight = h;
  var objectHeightOnScreen = (objectHeight / height) * canvasHeight; // visible height
  // return objectHeightOnScreen;
  var objectWidthOnScreen = objectHeightOnScreen * objectRatio;
}


const getImageSizeOnScreen = (img_src) => new Promise((res, rej) => {
  var canvasHeight = window.innerHeight + CANVAS_OUT_MARGIN;
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


export { getImageSizeOnScreen, IMAGE_SCALE, CAMERA_FOV, CAMERA_DISTANCE, CANVAS_OUT_MARGIN }