const express = require('express')
const app = express()
const appController = require('./controllers/appController')

app.set('view engine' , 'ejs')

appController(app)

app.listen(3000 , () => console.log('server runnng on 3000'))