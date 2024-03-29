import { Router } from "express";
import CartDAO from '../models/daos/carts.dao.js'
import productsModel from "../models/schemas/products.schema.js";
import SafeUsersDTO from '../models/DTO/safeUser.dto.js';
import { checkAdmin, checkSession, checkUser } from "../middlewares/auth.middleware.js";
import createProducts from "../mocking/mockingProducts.js";
import { recoveryPassToken } from "../utils/utils.js";

const router = Router()

router.get('/', (req, res) => {
    const toProducts = 'http://localhost:8080/products'
    const toCarts = 'http://localhost:8080/carts'
    const toLogin = 'http://localhost:8080/login'
    const toRegister = 'http://localhost:8080/register'
    const toProfile = 'http://localhost:8080/profile'
    const toChat = 'http://localhost:8080/chat'
    const toCurrent = 'http://localhost:8080/api/sessions/current'
    const toAdmin = 'http://localhost:8080/admin'
    const toPurchase = 'http://localhost:8080/api/tickets/6500b2f27498919c55e6d7f8/purchase'
    const toMockingProducts = 'http://localhost:8080/mockingproducts'
    res.render('landing', { toProducts, toCarts, toLogin, toRegister, toProfile, toChat, toCurrent, toAdmin, toPurchase, toMockingProducts })
})

router.get('/register', (req, res) => {
    res.render('register')
})

router.get('/login', (req, res) => {
    const session = { current: false }
    if (req.session.user) {
        console.log('already logged in')
        session.current = true
        session.name = req.session.user.first_name
    }
    res.render('login', { session })
})

router.get('/password-recovery-request', (req, res) => {
    const session = { current: false }
    if (req.session.user) {
        console.log('already logged in')
        session.current = true
        session.name = req.session.user.first_name
    }
    res.render('password-recovery-request', { session })
})

router.get('/reset-password/:token', recoveryPassToken, (req, res) => {
    const { userEmail, currentPassword } = req.tokenData;

    res.render('reset-password', { userEmail, currentPassword })
})


router.get('/products', checkSession, async (req, res) => {
    try {
        const user = req.session.user
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 5
        const sort = parseInt(req.query.sort) || -1
        const category = req.query.category || ''

        //Armamos la pipeline del aggregate
        const skip = (page - 1) * limit; //calcula algo que nose
        const matchStage = category ? { category: category } : {}; //Si existe joya, sino lo deja vacio

        const countPipeline = [ //variable condicional
            { $match: matchStage }, //se filtra por category, si esta vacio devuelve todo sin filtrar
            { $count: 'totalCategoryCount' },//$count siempre va a devolver la cantidad de docs, el string es libre
        ];
        //ejecuta la pipeline para obtener el resultado
        const totalCountResult = await productsModel.aggregate(countPipeline).exec();
        //totalCounResult no es un array, pero length igual recibe el dato. Se usa en hasNextPage
        const totalCategoryCount = totalCountResult.length > 0 ? totalCountResult[0].totalCategoryCount : 0;

        //pasamos los valores a la pipeline
        const pipeline = [
            { $match: matchStage },
            { $sort: { price: sort } },
            { $skip: skip },
            { $limit: limit },
        ];

        const products = await productsModel.aggregate(pipeline).exec();
        //validaciones de cantidad de paginas segun resultados anteriores
        const hasNextPage = skip + products.length < totalCategoryCount; //boolean
        const hasPrevPage = page > 1;//boolean
        const nextPage = hasNextPage ? page + 1 : null;
        const prevPage = hasPrevPage ? page - 1 : null;

        res.render('products', { products, hasPrevPage, hasNextPage, prevPage, nextPage, limit, sort, category, user })

    } catch (error) { res.status(500).send({ status: 'error', error: error.message }); }
})

router.get('/carts', checkSession, async (req, res) => {
    let response = await CartDAO.getAll()
    let carts = response.carts
    res.render('carts', { carts })
})

router.get('/profile', checkSession, async (req, res) => {
    const safeUserData = new SafeUsersDTO(req.session.user)
    res.render('profile', { user: safeUserData })

})

router.get('/chat', checkSession, checkUser, (req, res) => {
    if (!req.session.user) {
        res.render('failedlogin')
    } else {
        res.render('chat', {
            style: 'index.css',
            userName: req.session.user.first_name,
            userEmail: req.session.user.email,
        })
    }
})

router.get('/admin', checkSession, checkAdmin, async (req, res) => {
    res.render('admin')
})

router.get('/carts/:cid', async (req, res) => {
    if (!req.session.user) {
        res.render('failedlogin')
        return
    }
    const cid = req.params.cid
    const response = await CartDAO.getCartById(cid)
    const thisCart = response.cart

    const products = thisCart.products.map(productData => ({
        ...productData.product.toObject(),
        quantity: productData.quantity
    }));
    res.render('cart', { cid, products })
})

router.get('/mockingproducts', async (req, res) => {
    try {
        let randomProducts = await createProducts(100)
        res.send({ message: 'Mock products x100 created with faker and falso.', payload: randomProducts })
    } catch (error) {

        throw new Error(error.message)
        //     name: "mocking-products error",
        //     error: error,
        //     message: error.message,
        //     code: EError.MOCKING_ERROR
        // })
    }
})


export default router