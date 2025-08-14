import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { getSetting, type Settings } from "@/utils.ts"

export const useSettingStore = defineStore("settings", () => {
	const settings = reactive(getSetting() as Settings)

	const theme = computed(() => settings.theme)
	const isCollapse = computed(() => settings.isCollapse)

	const themeClass = computed(() => `theme-${settings.theme}`)

	const globalBgClass = computed(() => {
		switch (theme.value) {
			case "dark":
				return "bg-[#1f1f1f] text-white"
			case "light":
				return "bg-white text-black"
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
		globalBgClass,
		changeTheme,
		toggleTheme,
		toggleSidebar,
		updateThemeClass,
	}
})
