import express from 'express'
import cors from 'cors'
import auth from './auth.js'
import request from './request.js'
const app = express()
const port = 3000

app.use(express.json())

// Путь к базе данных Access
app.use(
	cors({
		origin: [process.env.CORS_ORIGIN_SITE, 'http://localhost:5173'],
		credentials: true,
	}),
)
app.use('/api', request)
app.use('/auth', auth)
app.get('/', (req, res) => {
	res.json({ message: 'API работает', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
	console.log(`Сервер запущен на http://localhost:${port}`)
})

export default app