import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { mockCarts, mockUsers } from './mock/users.js'
const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Путь к файлу данных (используем /tmp для Vercel)
const DATA_DIR =
	process.env.NODE_ENV === 'production'
		? '/tmp'
		: path.join(__dirname, '..', 'data')

const USERS_FILE = path.join(DATA_DIR, 'users.json')
const CARTS_FILE = path.join(DATA_DIR, 'carts.json')

// Убедимся, что директория существует
async function ensureDataDir() {
	try {
		await fs.access(DATA_DIR)
	} catch {
		await fs.mkdir(DATA_DIR, { recursive: true })
	}
}

// Утилиты для работы с файлами
async function readJSONFile(filePath, defaultValue = []) {
	try {
		await ensureDataDir()
		const data = await fs.readFile(filePath, 'utf-8')
		return JSON.parse(data)
	} catch (error) {
		// Если файла нет, возвращаем значение по умолчанию
		if (error.code === 'ENOENT') {
			return defaultValue
		}
		console.error(`Ошибка чтения файла ${filePath}:`, error)
		return defaultValue
	}
}

async function writeJSONFile(filePath, data) {
	try {
		await ensureDataDir()
		await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
	} catch (error) {
		console.error(`Ошибка записи файла ${filePath}:`, error)
		throw error
	}
}

// Получить пользователей
async function getUsers() {
	const users = await readJSONFile(USERS_FILE)

	// Если файл пустой, инициализируем начальными данными
	if (users.length === 0) {
		await writeJSONFile(USERS_FILE, mockUsers)
		return mockUsers
	}

	return users
}

// Получить корзины
async function getCarts() {
	const carts = await readJSONFile(CARTS_FILE)

	// Если файл пустой, инициализируем начальными данными
	if (carts.length === 0) {
		await writeJSONFile(CARTS_FILE, mockCarts)
		return mockCarts
	}

	return carts
}

// Сохранить пользователей
async function saveUsers(users) {
	await writeJSONFile(USERS_FILE, users)
}

// Сохранить корзины
async function saveCarts(carts) {
	await writeJSONFile(CARTS_FILE, carts)
}

// Получить максимальный ID пользователя
function getMaxUserId(users) {
	return users.length > 0 ? Math.max(...users.map(u => u.ID_Клиента)) : 1
}

// МАРШРУТЫ
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body

		const users = await getUsers()
		const user = users.find(u => u.Почта === email && u.Пароль === password)

		if (!user) {
			return res.status(401).json({
				success: false,
				message: 'Неверный email или пароль',
			})
		}

		res.json({
			success: true,
			message: 'Вход выполнен',
			data: user,
		})
	} catch (error) {
		console.error('Ошибка входа:', error)
		res.status(500).json({
			success: false,
			message: 'Ошибка сервера',
		})
	}
})

router.post('/signup', async (req, res) => {
	try {
		const { ФИ, Отчество, email, password } = req.body

		// Получаем текущих пользователей
		const users = await getUsers()

		// Проверяем, существует ли пользователь
		const existingUser = users.find(u => u.Почта === email)
		if (existingUser) {
			return res.status(409).json({
				success: false,
				message: 'Пользователь уже существует',
			})
		}

		// Генерируем новый ID
		const maxId = getMaxUserId(users)
		const newId = maxId + 1

		const newUser = {
			ID_Клиента: newId,
			ФИ,
			Отчество: Отчество || null,
			Почта: email,
			Пароль: password,
			ID_корзины: newId,
		}

		// Добавляем пользователя и сохраняем
		users.push(newUser)
		await saveUsers(users)

		// Создаем корзину для пользователя
		const carts = await getCarts()
		carts.push({
			ID_корзины: newId,
			ID_клиента: newId,
		})
		await saveCarts(carts)

		res.status(201).json({
			success: true,
			message: 'Регистрация успешна',
			data: newUser,
		})
	} catch (error) {
		console.error('Ошибка регистрации:', error)
		res.status(500).json({
			success: false,
			message: 'Ошибка регистрации',
		})
	}
})

// Дополнительные маршруты для управления данными
router.get('/users', async (req, res) => {
	try {
		const users = await getUsers()
		res.json({
			success: true,
			data: users,
			total: users.length,
		})
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Ошибка получения пользователей',
		})
	}
})

export default router
