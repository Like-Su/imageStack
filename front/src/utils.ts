import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants"
import * as punycode from "punycode"

export const getAccessToken = () => {
  return localStorage.getItem(ACCESS_TOKEN)
}

export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN)
}

export const setAccessToken = (value: string) => {
  localStorage.setItem(ACCESS_TOKEN, value)
  return true
}

export const setRefreshToken = (value: string) => {
  localStorage.setItem(REFRESH_TOKEN, value)
  return true
}

export const isSuccessCode = (code: number) => {
  return code >= 200 && code < 300
}
