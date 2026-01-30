import express from 'express'
import { mockCarts, mockUsers } from './mock/users.js'
const router = express.Router()

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body

		const user = mockUsers.find(u => u.Почта === email && u.Пароль === password)

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

		const existingUser = mockUsers.find(u => u.Почта === email)
		if (existingUser) {
			return res.status(409).json({
				success: false,
				message: 'Пользователь уже существует',
			})
		}

		const newUser = {
			ID_Клиента: mockUsers.length + 2,
			ФИ,
			Отчество: Отчество || null,
			Почта: email,
			Пароль: password,
			ID_корзины: mockUsers.length + 2,
		}

		mockUsers.push(newUser)
		mockCarts.push({
			ID_корзины: newUser.ID_корзины,
			ID_клиента: newUser.ID_Клиента,
		})

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

export default router
