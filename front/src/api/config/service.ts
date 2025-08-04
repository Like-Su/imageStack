import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios"
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/utils.ts"
import { refreshToken } from "@/api/user.ts"

interface PendingTask {
  config: AxiosRequestConfig
  resolve: Function
}

let refreshsing = false
const taskQueue: PendingTask[] = []

const isErrorCode = (status: number) =>
  (status >= 200 && status < 300) || status === 301

export const newRefreshToken = async () => {
  const oldRefreshToken = getRefreshToken(),
    response = await refreshToken(oldRefreshToken),
    tokens = response.data

  if (tokens.access_token && tokens.refresh_token) {
    setAccessToken(tokens.access_token)
    setRefreshToken(tokens.refresh_token)
  }
  return response
}

const config: AxiosRequestConfig = {
  baseURL: import.meta.env.BASE_URL,
  timeout: 30000,
  method: "get",
  // responseType: 'json'
  validateStatus: isErrorCode,
}

const axiosInstance = axios.create(config)

axiosInstance.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
}, Promise.reject)

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { statusCode, config } = response.data
    // console.log(response)
    // token 失效
    if (statusCode === 401 && !config.url.includes("/user/refresh")) {
      refreshsing = true
      const res = newRefreshToken()
      refreshsing = false
      if (res.status === 200) {
        taskQueue.forEach(({ config, resolve }) => resolve(axios(config)))
        return axios(config)
      } else {
        return Promise.reject(res.data)
      }
    }

    // 处理文件下载
    // TODO

    return response.data
  },
  (err) => {
    const { config } = err.response

    if (refreshsing) {
      return new Promise((resolve) => taskQueue.push({ config, resolve }))
    }
    return err.response
  },
)

export default axiosInstance
