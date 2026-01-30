import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import mockProducts from './mock/products.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Путь к файлу данных (используем /tmp для Vercel)
const DATA_DIR =
	process.env.NODE_ENV === 'production'
		? '/tmp'
		: path.join(__dirname, '..', 'data')

const CART_FILE = path.join(DATA_DIR, 'cart.json')

// Убедимся, что директория существует
async function ensureDataDir() {
	try {
		await fs.access(DATA_DIR)
	} catch {
		await fs.mkdir(DATA_DIR, { recursive: true })
	}
}

// Утилиты для работы с файлами
async function readCartFile() {
	try {
		await ensureDataDir()
		const data = await fs.readFile(CART_FILE, 'utf-8')
		return JSON.parse(data)
	} catch (error) {
		// Если файла нет, возвращаем пустой массив
		if (error.code === 'ENOENT') {
			return []
		}
		console.error(`Ошибка чтения файла ${CART_FILE}:`, error)
		return []
	}
}

async function writeCartFile(cartItems) {
	try {
		await ensureDataDir()
		await fs.writeFile(CART_FILE, JSON.stringify(cartItems, null, 2), 'utf-8')
	} catch (error) {
		console.error(`Ошибка записи файла ${CART_FILE}:`, error)
		throw error
	}
}

// Получить все товары
router.get('/products', async (req, res) => {
	try {
		res.json({
			success: true,
			data: mockProducts,
			total: mockProducts.length,
			source: 'json-file',
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
		const userId = req.params.userId

		// Читаем корзину из файла
		const cartItems = await readCartFile()

		// Находим товары в корзине пользователя
		const userCartItems = cartItems.filter(item => item.ID_корзины == userId)

		// Обогащаем данные товарами
		const enrichedCart = userCartItems
			.map(cartItem => {
				const product = mockProducts.find(
					p => p.ID_товара == cartItem.ID_товара,
				)
				if (!product) {
					return null
				}
				return {
					...product,
					Количество: cartItem.Количество,
					ID_товара_корзины: cartItem.ID_товара_корзины,
				}
			})
			.filter(item => item !== null)

		res.json({
			success: true,
			data: enrichedCart,
			source: 'json-file',
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
		const product = mockProducts.find(p => p.ID_товара == ID_товара)
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		// Читаем текущую корзину
		const cartItems = await readCartFile()

		// Проверяем, есть ли уже такой товар в корзине
		const existingItemIndex = cartItems.findIndex(
			item => item.ID_корзины == ID_корзины && item.ID_товара == ID_товара,
		)

		if (existingItemIndex !== -1) {
			// Обновляем количество существующего товара
			cartItems[existingItemIndex].Количество =
				parseInt(cartItems[existingItemIndex].Количество) + parseInt(Количество)

			await writeCartFile(cartItems)

			return res.status(201).json({
				success: true,
				message: 'Количество товара обновлено',
				data: cartItems[existingItemIndex],
				source: 'json-file',
			})
		}

		// Создаем новую запись
		const newCartItem = {
			ID_товара_корзины: Date.now(), // Временный ID
			ID_корзины: parseInt(ID_корзины),
			ID_товара: parseInt(ID_товара),
			Количество: parseInt(Количество),
			addedAt: new Date().toISOString(),
		}

		// Добавляем в массив и сохраняем
		cartItems.push(newCartItem)
		await writeCartFile(cartItems)

		res.status(201).json({
			success: true,
			message: 'Товар добавлен в корзину',
			data: newCartItem,
			source: 'json-file',
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

		// Читаем текущую корзину
		const cartItems = await readCartFile()

		// Находим товар в массиве
		const cartItemIndex = cartItems.findIndex(
			item => item.ID_товара_корзины == itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар в корзине не найден',
			})
		}

		// Обновляем количество
		cartItems[cartItemIndex].Количество = parseInt(Количество)
		cartItems[cartItemIndex].updatedAt = new Date().toISOString()

		// Сохраняем изменения
		await writeCartFile(cartItems)

		res.json({
			success: true,
			message: 'Количество обновлено',
			data: cartItems[cartItemIndex],
			source: 'json-file',
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

		// Читаем текущую корзину
		const cartItems = await readCartFile()

		// Находим товар в массиве
		const cartItemIndex = cartItems.findIndex(
			item => item.ID_товара_корзины == itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		// Удаляем
		const removedItem = cartItems.splice(cartItemIndex, 1)[0]

		// Сохраняем изменения
		await writeCartFile(cartItems)

		res.json({
			success: true,
			message: 'Товар удален из корзины',
			data: removedItem,
			source: 'json-file',
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

		// Читаем текущую корзину
		const cartItems = await readCartFile()

		// Фильтруем массив
		const removedItems = cartItems.filter(item => item.ID_корзины == userId)
		const newCartItems = cartItems.filter(item => item.ID_корзины != userId)

		// Сохраняем изменения
		await writeCartFile(newCartItems)

		res.json({
			success: true,
			message: 'Корзина очищена',
			itemsRemoved: removedItems.length,
			source: 'json-file',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

export default router
