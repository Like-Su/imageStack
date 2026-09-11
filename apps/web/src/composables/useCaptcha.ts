import { translate } from "@/i18n";
import { onBeforeUnmount, onMounted, ref } from "vue";
import DOMPurify from "dompurify";
import { authApi } from "@/api/auth";
import { getErrorMessage } from "@/api/request";

export function useCaptcha() {
  const captchaId = ref("");
  const image = ref("");
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;

  async function refresh() {
    controller?.abort();
    const currentController = new AbortController();
    controller = currentController;
    loading.value = true;
    error.value = "";
    captchaId.value = "";
    image.value = "";

    try {
      const result = await authApi.captcha(currentController.signal);
      if (currentController.signal.aborted) return;
      const svg = DOMPurify.sanitize(result.image, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      if (!result.captchaId || !svg.includes("<svg"))
        throw new Error(translate("验证码加载失败，请点击重试"));
      captchaId.value = result.captchaId;
      image.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch (caught) {
      if (!currentController.signal.aborted)
        error.value = getErrorMessage(caught);
    } finally {
      if (controller === currentController) loading.value = false;
    }
  }

  onMounted(refresh);
  onBeforeUnmount(() => controller?.abort());

  return { captchaId, image, loading, error, refresh };
}
