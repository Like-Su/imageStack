import { defineStore } from "pinia"
import { reactive } from "vue"
import * as constants from "constants"
import { getSetting } from "@/utils.ts"

export const useSettingStore = defineStore("settings", () => {
	const settings = reactive(getSetting())

	const changeTheme = (theme: string) => {
		settings.theme = theme
	}

	const changeSidebar = (sidebar: boolean) => {
		settings.sidebar = sidebar
	}

	return {
		settings,
		changeTheme,
		changeSidebar,
	}
})
