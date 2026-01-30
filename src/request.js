import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import mockProducts from './mock/products.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Инициализация ADODB только для Windows
let connection = null
if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') {
	try {
		const { default: ADODB } = await import('node-adodb')
		const dbPath = path.join(__dirname, 'Magazin.accdb')

		connection = ADODB.open(
			`Provider=Microsoft.ACE.OLEDB.12.0;Data Source="${dbPath}";Persist Security Info=False;`,
			process.arch.includes('64'),
		)
		console.log('✅ ADODB подключен (Windows)')
	} catch (error) {
		console.log('⚠️ ADODB недоступен, используем mock данные')
	}
}

// ==================== ПОЛУЧЕНИЕ ДАННЫХ ИЗ БАЗЫ ====================

// Получаем ВСЕ данные из базы один раз при старте
let databaseCache = {
	products: [],
	cartItems: [],
	users: [],
}

async function loadDatabaseData() {
	if (!connection) {
		console.log('📦 Используем mock данные')
		// Mock данные
		databaseCache.products = mockProducts
		databaseCache.cartItems = []
		databaseCache.users = []
		return
	}

	try {
		console.log('📥 Загрузка данных из базы...')

		// Получаем все товары
		databaseCache.products = await connection.query('SELECT * FROM Товары')
		console.log(`✅ Загружено товаров: ${databaseCache.products.length}`)

		// Получаем все корзины
		databaseCache.cartItems = await connection.query(
			'SELECT * FROM Товары_в_корзине',
		)
		console.log(
			`✅ Загружено позиций в корзинах: ${databaseCache.cartItems.length}`,
		)

		// Получаем пользователей (если есть таблица)
		try {
			databaseCache.users = await connection.query('SELECT * FROM Клиенты')
			console.log(`✅ Загружено Клиентов: ${databaseCache.users.length}`)
		} catch {
			console.log('ℹ️ Таблица Клиенты не найдена')
		}
	} catch (error) {
		console.error('❌ Ошибка загрузки данных:', error.message)
	}
}

// Загружаем данные при старте
loadDatabaseData()

// ==================== МАРШРУТЫ ====================

// Получить все товары
router.get('/products', async (req, res) => {
	try {
		res.json({
			success: true,
			data: databaseCache.products,
			total: databaseCache.products.length,
			source: connection ? 'database' : 'mock',
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res
			.status(500)
			.json({ success: false, message: 'Ошибка сервера', data: mockProducts })
	}
})

// Получить корзину пользователя
router.get('/cart/:userId', async (req, res) => {
	try {
		const userId = req.params.userId

		// Находим товары в корзине пользователя
		const userCartItems = databaseCache.cartItems.filter(
			item => item.ID_корзины === userId,
		)

		// Обогащаем данные товарами
		const enrichedCart = userCartItems.map(cartItem => {
			const product = databaseCache.products.find(
				p => p.ID_товара === cartItem.ID_товара,
			)
			return {
				...product,
				Количество: cartItem.Количество,
				ID_товара_корзины: cartItem.ID_товара_корзины,
			}
		})

		res.json({
			success: true,
			data: enrichedCart,
			source: connection ? 'database' : 'mock',
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
		const product = databaseCache.products.find(
			p => p.ID_товара === parseInt(ID_товара),
		)
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

		// Добавляем в кэш
		databaseCache.cartItems.push(newCartItem)

		// Если есть подключение к БД - сохраняем
		if (connection) {
			const query = `INSERT INTO Товары_в_корзине (ID_корзины, ID_товара, Количество) 
                     VALUES (${ID_корзины}, ${ID_товара}, ${Количество})`
			await connection.execute(query)
		}

		res.status(201).json({
			success: true,
			message: 'Товар добавлен в корзину',
			data: newCartItem,
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Обновить количество товара в корзине
router.put('/cart/count/:itemId', async (req, res) => {
	try {
		const itemId = req.params.itemId
		const { Количество } = req.body

		if (!Количество || Количество < 1) {
			return res.status(400).json({
				success: false,
				message: 'Некорректное количество',
			})
		}

		// Находим товар в кэше
		const cartItemIndex = databaseCache.cartItems.findIndex(
			item => item.ID_товара_корзины === itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар в корзине не найден',
			})
		}

		// Обновляем в кэше
		databaseCache.cartItems[cartItemIndex].Количество = Количество

		// Если есть подключение к БД - обновляем
		if (connection) {
			const query = `UPDATE Товары_в_корзине SET Количество = ${Количество} 
                     WHERE ID_товара_корзины = ${itemId}`
			await connection.execute(query)
		}

		res.json({
			success: true,
			message: 'Количество обновлено',
			data: databaseCache.cartItems[cartItemIndex],
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Удалить товар из корзины
router.delete('/cart/:itemId', async (req, res) => {
	try {
		const itemId = req.params.itemId

		// Находим товар в кэше
		const cartItemIndex = databaseCache.cartItems.findIndex(
			item => item.ID_товара_корзины === itemId,
		)

		if (cartItemIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		// Удаляем из кэша
		const removedItem = databaseCache.cartItems.splice(cartItemIndex, 1)[0]

		// Если есть подключение к БД - удаляем
		if (connection) {
			const query = `DELETE FROM Товары_в_корзине 
                     WHERE ID_товара_корзины = ${itemId}`
			await connection.execute(query)
		}

		res.json({
			success: true,
			message: 'Товар удален из корзины',
			data: removedItem,
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

// Очистить всю корзину пользователя
router.delete('/cartAll/:userId', async (req, res) => {
	try {
		const userId = req.params.userId

		// Фильтруем кэш
		const removedItems = databaseCache.cartItems.filter(
			item => item.ID_корзины === userId,
		)

		databaseCache.cartItems = databaseCache.cartItems.filter(
			item => item.ID_корзины !== userId,
		)

		// Если есть подключение к БД - удаляем
		if (connection) {
			const query = `DELETE FROM Товары_в_корзине WHERE ID_корзины = ${userId}`
			await connection.execute(query)
		}

		res.json({
			success: true,
			message: 'Корзина очищена',
			itemsRemoved: removedItems.length,
		})
	} catch (error) {
		console.error('Ошибка:', error)
		res.status(500).json({ success: false, message: 'Ошибка сервера' })
	}
})

export default router
