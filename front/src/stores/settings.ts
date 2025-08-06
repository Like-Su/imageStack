import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { getSetting, type Settings } from "@/utils.ts"

export const useSettingStore = defineStore("settings", () => {
	const settings = reactive(getSetting() as Settings)

	const theme = computed(() => settings.theme)
	const isCollapse = computed(() => settings.isCollapse)

	const themeClass = computed(() => `theme-${settings.theme}`)

	const sidebarBgClass = computed(() => {
		switch (theme.value) {
			case "dark":
				return "bg-gray-900 text-white"
			case "light":
				return "bg-gray-100 text-black"
			default:
				break
		}
	})

	const headerBgClass = computed(() => {
		switch (theme.value) {
			case "dark":
				return "bg-gray-800 text-white"
			case "light":
				return "bg-gray-200 text-black"
			default:
				break
		}
	})

	const changeTheme = (theme: string) => {
		settings.theme = theme
	}

	const toggleTheme = () => {
		if (settings.theme === "light") {
			settings.theme = "dark"
		} else {
			settings.theme = "light"
		}
	}

	const toggleSidebar = () => {
		settings.isCollapse = !settings.isCollapse
	}

	const updateThemeClass = () =>
		document.documentElement.classList.add(themeClass.value)

	return {
		settings,
		theme,
		isCollapse,
		themeClass,
		sidebarBgClass,
		headerBgClass,
		changeTheme,
		toggleTheme,
		toggleSidebar,
		updateThemeClass,
	}
})
