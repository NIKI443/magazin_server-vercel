import express from 'express'
import mockProducts from './mock/products.js'
const router = express.Router()

// ХРАНЕНИЕ ДАННЫХ В ПАМЯТИ ДЛЯ VERCEL
let cartItems = []

console.log('🚀 Сервер запущен в режиме Vercel/Linux (mock данные)')

// ==================== МАРШРУТЫ ====================

// Получить все товары
router.get('/products', async (req, res) => {
	try {
		res.json({
			success: true,
			data: mockProducts,
			total: mockProducts.length,
			source: 'mock',
			platform: process.platform,
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Получить корзину пользователя
router.get('/cart/:userId', async (req, res) => {
	try {
		const userId = parseInt(req.params.userId)

		// Находим товары в корзине пользователя
		const userCartItems = cartItems.filter(item => item.ID_корзины === userId)

		// Обогащаем данные товарами
		const enrichedCart = userCartItems.map(cartItem => {
			const product = mockProducts.find(p => p.ID_товара === cartItem.ID_товара)
			return {
				...product,
				Количество: cartItem.Количество,
				ID_товара_корзины: cartItem.ID_товара_корзины,
			}
		})

		res.json({
			success: true,
			data: enrichedCart,
			source: 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Добавить товар в корзину
router.post('/product', async (req, res) => {
	try {
		const { ID_корзины, ID_товара, Количество } = req.body

		if (!ID_корзины || !ID_товара || !Количество) {
			return res.status(400).json({
				success: false,
				message: 'Не все поля заполнены',
			})
		}

		// Проверяем существует ли товар
		const product = mockProducts.find(p => p.ID_товара === parseInt(ID_товара))
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		// Создаем новую запись
		const newCartItem = {
			ID_товара_корзины: Date.now(), // Временный ID
			ID_корзины: parseInt(ID_корзины),
			ID_товара: parseInt(ID_товара),
			Количество: parseInt(Количество),
		}

		// Добавляем в массив
		cartItems.push(newCartItem)

		res.status(201).json({
			success: true,
			message: 'Товар добавлен в корзину',
			data: newCartItem,
			source: 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Обновить количество товара в корзине
router.post('/cart/count/:itemId', async (req, res) => {
	try {
		const itemId = parseInt(req.params.itemId)
		const { Количество } = req.body

		if (!Количество || Количество < 1) {
			return res.status(400).json({
				success: false,
				message: 'Некорректное количество',
			})
		}

		// Находим товар в массиве
		const cartItemIndex = cartItems.findIndex(
			item => item.ID_товара_корзины === itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар в корзине не найден',
			})
		}

		// Обновляем
		cartItems[cartItemIndex].Количество = Количество

		res.json({
			success: true,
			message: 'Количество обновлено',
			data: cartItems[cartItemIndex],
			source: 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Удалить товар из корзины
router.delete('/cart/:itemId', async (req, res) => {
	try {
		const itemId = parseInt(req.params.itemId)

		// Находим товар в массиве
		const cartItemIndex = cartItems.findIndex(
			item => item.ID_товара_корзины === itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		// Удаляем
		const removedItem = cartItems.splice(cartItemIndex, 1)[0]

		res.json({
			success: true,
			message: 'Товар удален из корзины',
			data: removedItem,
			source: 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Очистить всю корзину пользователя
router.delete('/cartAll/:userId', async (req, res) => {
	try {
		const userId = parseInt(req.params.userId)

		// Фильтруем массив
		const removedItems = cartItems.filter(item => item.ID_корзины === userId)
		cartItems = cartItems.filter(item => item.ID_корзины !== userId)

		res.json({
			success: true,
			message: 'Корзина очищена',
			itemsRemoved: removedItems.length,
			source: 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

export default router
