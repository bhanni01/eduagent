import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

export const chatStudent = (message, history) =>
  api.post('/api/chat/student', { message, history })

export const chatParent = (message, history) =>
  api.post('/api/chat/parent', { message, history })

export const getStudent = (name) =>
  api.get(`/api/parent/student/${encodeURIComponent(name)}`)

export const getStudentSummary = (name) =>
  api.get(`/api/parent/student/${encodeURIComponent(name)}/summary`)

export const checkHealth = () =>
  api.get('/api/health')

export default api
