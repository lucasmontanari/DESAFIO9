import express from 'express'
const app = express()
import path from 'path'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io'
const expressServer = app.listen(8080, () => console.log('Servidor escuchando puerto 8080'))
const io = new Server(expressServer)
import rutas from './routes/rutas.js'
import { schema, normalize } from "normalizr";
import 'dotenv/config'
const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import session from "express-session";

const __dirname = dirname(fileURLToPath(import.meta.url));

import ContenedorMensaje from './dao/MensajeDaoMongoDb.js'
const mensajes = new ContenedorMensaje()
import ContenedorProducto from './dao/ProductoDaoMongoDb.js'
const productos = new ContenedorProducto()

let mensajesEnBaseDeDatos = []
let productosEnBaseDeDatos = []

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/public', express.static(`${__dirname}/public`))
app.use(express.static(path.join(__dirname, './public')))

app.use('/api/', rutas)

//COOKIE
const mongoOptions = { useNewUrlParser: true, useUnifiedTopology: true };
let ultimoUsuario

app.use(cookieParser());
app.use(
  session({
    store: MongoStore.create({
      mongoUrl:
        `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`,
      mongoOptions
    }),
    secret: "coderhouse",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reinicia el tiempo de expiracion con cada request
    cookie: {
      maxAge: 60000,
    },
  })
);

function authMiddleware(req, res, next) {
  if (req.session.username) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.get("/", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "/public/home.html"));
});

app.get("/user", (req, res) => {
  res.json(ultimoUsuario);
});

function loginMiddleware(req, res, next) {
  if (req.session.username) {
    res.redirect("/");
  } else {
    next();
  }
}

app.get("/login", loginMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "./public/login.html"));
});

app.post("/login", async (req, res) => {
  try {
    ultimoUsuario = req.body.username
    req.session.username = req.body.username;

    res.redirect("/");
  } catch (err) {
    res.json({ error: true, message: err });
  }
});


app.get("/logout", authMiddleware, async (req, res) => {
  req.session.destroy(err => {
    if (!err) {
      res.sendFile(path.join(__dirname, "./public/logout.html"));
    } else {
      res.json({ status: 'Logout error', body: err })
    }
  })
});



//NORMALIZR

const author = new schema.Entity("author", {}, { idAttribute: "userEmail" });

const mensaje = new schema.Entity(
  "mensaje",
  { author: author },
  { idAttribute: "_id" }
);

const schemaMensajes = new schema.Entity(
  "mensajes",
  {
    mensajes: [mensaje],
  },
  { idAttribute: "id" }
);


io.on('connection', async socket => {
  console.log(`Se conecto un usuario ${socket.id}`)

  try {
    productosEnBaseDeDatos = await productos.getAll()
    socket.emit('server:productos', productosEnBaseDeDatos)
  } catch (error) {
    console.log(`Error al adquirir los productos ${error}`)
  }
  try {
    mensajesEnBaseDeDatos = await mensajes.getAll()
    const normalizedMensajes = normalize(
      { id: "mensajes", mensajes: mensajesEnBaseDeDatos },
      schemaMensajes
    );
    socket.emit('server:mensajes', normalizedMensajes)
  } catch (error) {
    console.log(`Error al adquirir los mensajes ${error}`)
  }
  socket.on('cliente:mensaje', async nuevoMensaje => {
    await mensajes.save(nuevoMensaje)
    mensajesEnBaseDeDatos = await mensajes.getAll()
    const normalizedMensajes = normalize(
      { id: "mensajes", mensajes: mensajesEnBaseDeDatos },
      schemaMensajes
    );
    io.emit('server:mensajes', normalizedMensajes)
  })
  socket.on('cliente:producto', async nuevoProducto => {
    await productos.save(nuevoProducto)
    productosEnBaseDeDatos = await productos.getAll()
    io.emit('server:productos', productosEnBaseDeDatos)
  })
})