import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs"
import joi from "joi"

dotenv.config();

const userSchema = joi.object({
    name: joi.string().required()
})

const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid('message', 'private_message').required()
})

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('test');
});

app.post("/participants", async (req, res) => {
    const {name} = req.body;
    const validation = userSchema.validate(req.body)

    if(validation.error){
        return res.sendStatus(422);
    }

    try {
        const participants = await db.collection('participants').findOne({name});
        if(!!participants){
            return res.sendStatus(409);
        }

        await db.collection('participants').insertOne({name, lastStatus: Date.now()});
        const userLogin = {
            from: name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format("HH:mm:ss")
        };
        await db.collection('messages').insertOne(userLogin);
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
})

app.get("/participants", async (req, res) => {

    try {
        const participants = await db.collection("participants").find({}).toArray();
        res.send(participants);
    } catch (error) {
        res.sendStatus(500);
    }

});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const validation = messagesSchema.validate(req.body)

    if(validation.error || !user){
        return res.sendStatus(422);
    }

    try {
        const participant = await db.collection("participants").findOne({name: user});
        if(!participant){
            return res.sendStatus(422);
        };

        const message = {
            from: user, 
            to: to, 
            text: text, 
            type: type, 
            time: dayjs().format("HH:mm:ss")
        };

        await db.collection('messages').insertOne(message);
        res.sendStatus(201);

    } catch (error) {
        res.sendStatus(500);
    }
    
});

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;


    if(limit){
        try {
            let messages = await db.collection("messages").find({}).toArray();
            messages = messages.filter((item => item.to === "Todos" || item.to === user || item.from === user ))
            return res.send(messages.slice(-limit));
        } catch (error) {
            return res.sendStatus(500);
        }

        
    }

    try {
        let messages = await db.collection("messages").find({}).toArray();
        messages = messages.filter((item => item.to === "Todos" || item.to === user || item.from === user))
        res.send(messages);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    
    try {
        const verificationUser = await db.collection('participants').findOne({name: user});
        
        if(!verificationUser){
            return res.sendStatus(404);
        }

        await db.collection('participants').updateOne({name: user}, { $set: {lastStatus: Date.now()} })
        res.sendStatus(200)

    } catch (error) {
        res.sendStatus(500)
    }

    

})

function removeUser(){
    setInterval(async () => {
    
        try {
            const users = await db.collection("participants").find().toArray();

            if(users.length === 0 ){
                return
            }

            for(let i = 0 ; i < users.length ; i++){

                if(Date.now() - users[i].lastStatus > 10000){
                    await db.collection("participants").deleteOne({name: users[i].name});
                    const userOff = {
                        from: users[i].name, 
                        to: 'Todos', 
                        text: 'saiu da sala...', 
                        type: 'status', 
                        time: dayjs().format("HH:mm:ss")
                    };
                    await db.collection("messages").insertOne(userOff)
                }
            }
        } catch (error) {
    
        }
    }, 15000)
}

removeUser()


//Bonus

app.delete("/messages/:IdMessage", async (req, res) =>{
    const { IdMessage } = req.params;

    try {
        await db.collection("messages").deleteOne({_id: ObjectId(IdMessage)})
        res.sendStatus(200)
    } catch (error) {
        res.sendStatus(500)
    }

})

app.put("/messages/:IdMessage", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const { IdMessage } = req.params;
    const validation = messagesSchema.validate(req.body)

    if(validation.error || !user){
        return res.sendStatus(422);
    }

    try {
        const participant = await db.collection("participants").findOne({name: user});
        if(!participant){
            return res.sendStatus(422);
        };

        const messageEdit = await db.collection("messages").findOne({_id: ObjectId(IdMessage)})
        if(!messageEdit){
            return res.sendStatus(422);
        }

        if(messageEdit.from !== user){
            return res.sendStatus(401)
        }

        const message = {
            from: user, 
            to: to, 
            text: text, 
            type: type
        };

        await db.collection('messages').updateOne({_id: ObjectId(IdMessage)}, { $set: message });
        res.sendStatus(201);

    } catch (error) {
        res.status(500).send(error)
    }
})

app.listen(5000, () => {
    console.log('Listen on port 5000');
});