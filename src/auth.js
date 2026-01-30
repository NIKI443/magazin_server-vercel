import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { mockCarts, mockUsers } from './mock/users.js'
const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ACCESS
let connection = null

// Проверяем, если мы на Vercel или Linux, используем мок-данные
const isVercel = process.env.VERCEL === '1'
const isLinux = process.platform === 'linux'

if (!isVercel && !isLinux && process.platform === 'win32') {
	try {
		// Используем динамический импорт для node-adodb
		const ADODB = await import('node-adodb')

		const dbPath = path.join(__dirname, 'Magazin.accdb')

		connection = ADODB.default.open(
			`Provider=Microsoft.ACE.OLEDB.12.0;Data Source="${dbPath}";Persist Security Info=False;`,
			process.arch.includes('64'),
		)

		console.log('✅ Подключено к реальной базе данных Access')
	} catch (error) {
		console.error('❌ Ошибка подключения к базе:', error.message)
		console.log('📦 Используем мок-данные')
	}
} else {
	console.log('🌐 Используем мок-данные (Vercel/Linux режим)')
}

// ФУНКЦИИ ДЛЯ РАБОТЫ С БАЗОЙ
async function queryDB(query) {
	// Если есть подключение к реальной базе - используем её
	if (connection) {
		try {
			if (query.trim().toUpperCase().startsWith('SELECT')) {
				return await connection.query(query)
			}
			return await connection.execute(query)
		} catch (error) {
			console.error('Ошибка запроса к базе:', error)
			throw error
		}
	}

	// Иначе используем мок-данные
	return mockQuery(query)
}

// МОК ФУНКЦИЯ ДЛЯ ОБРАБОТКИ ЗАПРОСОВ
function mockQuery(query) {
	console.log('🔍 Mock запрос:', query.substring(0, 100) + '...')

	// ПОИСК ПОЛЬЗОВАТЕЛЯ ПО EMAIL И ПАРОЛЮ
	if (
		query.includes('SELECT * FROM Клиенты WHERE Почта') &&
		query.includes('Пароль')
	) {
		const emailMatch =
			query.match(/Почта\s*=\s*'([^']+)'/) ||
			query.match(/Почта\s*LIKE\s*'%([^%]+)%'/)
		const passwordMatch =
			query.match(/Пароль\s*=\s*'([^']+)'/) ||
			query.match(/Пароль\s*LIKE\s*'%([^%]+)%'/)

		if (emailMatch && passwordMatch) {
			const email = emailMatch[1]
			const password = passwordMatch[1]
			return mockUsers.filter(
				u =>
					u.Почта.toLowerCase() === email.toLowerCase() &&
					u.Пароль === password,
			)
		}
	}

	// ПОИСК ПОЛЬЗОВАТЕЛЯ ТОЛЬКО ПО EMAIL
	if (query.includes('SELECT * FROM Клиенты WHERE Почта')) {
		const emailMatch =
			query.match(/Почта\s*=\s*'([^']+)'/) ||
			query.match(/Почта\s*LIKE\s*'%([^%]+)%'/)
		if (emailMatch) {
			const email = emailMatch[1]
			return mockUsers.filter(
				u => u.Почта.toLowerCase() === email.toLowerCase(),
			)
		}
	}

	// ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
	if (query.includes('SELECT * FROM Клиенты')) {
		return mockUsers
	}

	// ПОЛУЧЕНИЕ КОРЗИНЫ
	if (query.includes('SELECT * FROM Корзина')) {
		if (query.includes('ID_клиента')) {
			const idMatch = query.match(/ID_клиента\s*=\s*(\d+)/)
			if (idMatch) {
				const clientId = parseInt(idMatch[1])
				return mockCarts.filter(cart => cart.ID_клиента === clientId)
			}
		}
		return mockCarts
	}

	// ДОБАВЛЕНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ
	if (query.includes('INSERT INTO Клиенты')) {
		const matches = query.match(/VALUES\s*\([^)]*\)/)
		if (matches) {
			const newId = Math.max(...mockUsers.map(u => u.ID_Клиента)) + 1
			const newUser = {
				ID_Клиента: newId,
				ФИ: req.body?.ФИ || 'Новый пользователь',
				Отчество: req.body?.Отчество || null,
				Почта: req.body?.email || `user${newId}@example.com`,
				Пароль: req.body?.password || 'password123',
				ID_корзины: newId,
			}
			mockUsers.push(newUser)
			mockCarts.push({ ID_корзины: newId, ID_клиента: newId })
			return [newUser]
		}
	}

	// ДОБАВЛЕНИЕ НОВОЙ КОРЗИНЫ
	if (query.includes('INSERT INTO Корзина')) {
		const matches = query.match(/VALUES\s*\((\d+)\)/)
		if (matches) {
			const clientId = parseInt(matches[1])
			const newCart = {
				ID_корзины: Math.max(...mockCarts.map(c => c.ID_корзины)) + 1,
				ID_клиента: clientId,
			}
			mockCarts.push(newCart)
			return [newCart]
		}
	}

	return []
}

// МАРШРУТЫ
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: 'Введите email и пароль',
			})
		}

		// Ищем пользователя
		const users = await queryDB(
			`SELECT * FROM Клиенты WHERE Почта = '${email}' AND Пароль = '${password}'`,
		)

		if (users.length === 0) {
			return res.status(401).json({
				success: false,
				message: 'Неверный email или пароль',
			})
		}

		const user = users[0]

		// Получаем корзину
		const cart = await queryDB(
			`SELECT * FROM Корзина WHERE ID_клиента = ${user.ID_Клиента}`,
		)

		const userData = {
			...user,
			ID_корзины: cart.length > 0 ? cart[0].ID_корзины : null,
		}

		res.json({
			success: true,
			message: 'Вход выполнен',
			data: userData,
			mode: connection ? 'database' : 'mock',
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

		if (!ФИ || !email || !password) {
			return res.status(400).json({
				success: false,
				message: 'Заполните обязательные поля',
			})
		}

		// Проверяем, нет ли уже такого пользователя
		const existingUsers = await queryDB(
			`SELECT * FROM Клиенты WHERE Почта = '${email}'`,
		)

		if (existingUsers.length > 0) {
			return res.status(409).json({
				success: false,
				message: 'Пользователь с таким email уже существует',
			})
		}

		// Сохраняем данные для мок-режима
		if (!connection) {
			req.body = { ФИ, Отчество, email, password }
		}

		// Добавляем нового пользователя
		await queryDB(
			`INSERT INTO Клиенты (ФИ, Отчество, Почта, Пароль) 
       VALUES ('${ФИ}', '${Отчество || ''}', '${email}', '${password}')`,
		)

		// Получаем нового пользователя
		const newUsers = await queryDB(
			`SELECT * FROM Клиенты WHERE Почта = '${email}' AND Пароль = '${password}'`,
		)

		if (newUsers.length === 0) {
			throw new Error('Ошибка создания пользователя')
		}

		const newUser = newUsers[0]

		// Создаем корзину
		await queryDB(
			`INSERT INTO Корзина (ID_клиента) VALUES (${newUser.ID_Клиента})`,
		)

		// Получаем корзину
		const cart = await queryDB(
			`SELECT * FROM Корзина WHERE ID_клиента = ${newUser.ID_Клиента}`,
		)

		const userData = {
			...newUser,
			ID_корзины: cart.length > 0 ? cart[0].ID_корзины : null,
		}

		res.status(201).json({
			success: true,
			message: 'Регистрация успешна',
			data: userData,
			mode: connection ? 'database' : 'mock',
		})
	} catch (error) {
		console.error('Ошибка регистрации:', error)
		res.status(500).json({
			success: false,
			message: 'Ошибка регистрации',
		})
	}
})


// Получить всех пользователей (для отладки)
router.get('/users', async (req, res) => {
	const users = await queryDB('SELECT * FROM Клиенты')
	res.json({
		success: true,
		data: users,
		mode: connection ? 'database' : 'mock',
	})
})

export default router
