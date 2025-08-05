/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class", // 使用 class 控制暗黑模式
	content: [
		"./index.html",
		"./src/**/*.{vue,js,ts,jsx,tsx}", // 这里根据项目情况写，确保扫描所有含类的文件
	],
	theme: {
		extend: {
			// 在这里扩展自定义主题
		},
	},
	plugins: [],
}
