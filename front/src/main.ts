import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import { createPinia } from "pinia"
import antDesign from "./plugins/antDesign"
import VueLazyLoad from "vue3-lazy"
import { createHead } from "@vueuse/head"
import "tailwindcss/index.css"
import "ant-design-vue/dist/reset.css"
import "./assets/css/tailwind.css"

const pinia = createPinia()
const app = createApp(App)
const head = createHead()

app.use(router)
app.use(pinia)
app.use(antDesign)
app.use(VueLazyLoad, {
	// loading: "",
})
app.use(head)

app.config.errorHandler = (err) => {
	console.error("global", err)
}

app.mount("#app")
