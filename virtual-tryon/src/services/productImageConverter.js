const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const WHITE_FUZZ_DISTANCE = 0.1 * Math.sqrt(3 * 255 ** 2);

export async function convertToTransparentPng(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be smaller than 20 MB.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error("Image dimensions are too large to process.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create an image processing canvas.");

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = pixels;
    for (let i = 0; i < data.length; i += 4) {
      const redDistance = 255 - data[i];
      const greenDistance = 255 - data[i + 1];
      const blueDistance = 255 - data[i + 2];
      const distance = Math.sqrt(
        redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2
      );
      if (distance <= WHITE_FUZZ_DISTANCE) data[i + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);

    const png = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not encode the converted PNG."));
        },
        "image/png"
      );
    });
    return png;
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("Could not read this image. Try a PNG, JPEG, or WebP file.");
  } finally {
    bitmap?.close();
  }
}
