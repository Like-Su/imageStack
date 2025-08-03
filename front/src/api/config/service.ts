import axios, { type AxiosResponse, type AxiosRequestConfig } from 'axios';

const config: AxiosRequestConfig = {
  baseURL: import.meta.env.BASE_URL,
  timeout: 30000,
  method: 'get',
  // responseType: 'json'
  validateStatus(status) {
    return status >= 200 && status < 300 || status === 301;
  }
}

const axiosInstance = axios.create(config);

axiosInstance.interceptors.request.use(config => {
  return config;
}, Promise.reject);

axiosInstance.interceptors.response.use((response: AxiosResponse) => {
  return response;
})

export default axiosInstance;