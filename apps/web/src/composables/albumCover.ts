import { translate } from "@/i18n";

export async function prepareAlbumCover(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(translate("请选择 PNG、JPEG 或 WebP 图片"));
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error(translate("封面文件需大于 0 且不超过 5 MiB"));

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 20_000_000)
      throw new Error(translate("封面图片不能超过 2000 万像素"));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error(translate("当前浏览器无法处理封面图片"));
    const cropWidth = Math.min(
      image.naturalWidth,
      (image.naturalHeight * 4) / 3,
    );
    const cropHeight = (cropWidth * 3) / 4;
    for (const width of [640, 480, 320]) {
      canvas.width = Math.max(1, Math.round(Math.min(width, cropWidth)));
      canvas.height = Math.max(1, Math.round((canvas.width * 3) / 4));
      context.drawImage(
        image,
        (image.naturalWidth - cropWidth) / 2,
        (image.naturalHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      let cover = canvas.toDataURL("image/webp", 0.8);
      if (!cover.startsWith("data:image/webp"))
        cover = canvas.toDataURL("image/jpeg", 0.8);
      if (cover.length <= 65536) return cover;
    }
    throw new Error(translate("封面数据过大，请重新选择图片"));
  } catch (error) {
    if (error instanceof DOMException)
      throw new Error(translate("无法读取图片，请重新选择封面"));
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
