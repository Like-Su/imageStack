import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import { createPinia } from "pinia"
import antDesign from "./plugins/antDesign"
import "tailwindcss/index.css"
import "ant-design-vue/dist/reset.css"

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(antDesign)

app.mount("#app")
