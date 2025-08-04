import type { App } from "vue"
import { message } from "ant-design-vue"

export default (app: App) => {
  app.config.globalProperties.$message = message
  app.config.globalProperties.$messageSuccess = message.success
  app.config.globalProperties.$messageError = message.error
  app.config.globalProperties.$messageInfo = message.info
  app.config.globalProperties.$messageWarning = message.warning
  app.config.globalProperties.$messageLoading = message.loading
}
