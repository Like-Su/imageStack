import { translate } from "@/i18n";

export async function prepareProfileAvatar(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(translate("请选择 PNG、JPEG 或 WebP 图片"));
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error(translate("头像文件需大于 0 且不超过 5 MiB"));

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 20_000_000)
      throw new Error(translate("头像图片不能超过 2000 万像素"));
    const canvas = document.createElement("canvas");
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.width = canvas.height = Math.min(256, cropSize);
    const context = canvas.getContext("2d");
    if (!context) throw new Error(translate("当前浏览器无法处理头像"));
    context.drawImage(
      image,
      (image.naturalWidth - cropSize) / 2,
      (image.naturalHeight - cropSize) / 2,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    let avatar = canvas.toDataURL("image/webp", 0.8);
    if (!avatar.startsWith("data:image/webp"))
      avatar = canvas.toDataURL("image/jpeg", 0.8);
    if (avatar.length > 65536)
      throw new Error(translate("头像数据过大，请重新选择图片"));
    return avatar;
  } catch (error) {
    if (error instanceof DOMException)
      throw new Error(translate("无法读取图片，请重新选择头像"));
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
