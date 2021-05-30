const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "app.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running............");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}


//API 1
app.post("/register/", async (request, response) => {
  const {
    userId,
    userName,
    password,
    age,
    location,
    emailId,
    phoneNumber,
  } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE phone_number = '${phoneNumber}'`;
  const hashedPassword = await bcrypt.hash(password, 10);
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      if (phoneNumber.length !== 10) {
        response.status(400);
        response.send("Please Check the Number");
      } else {
        const insertUserQuery = `INSERT INTO user 
      (user_id,user_name,password,age,location,email_id,phone_number)
       VALUES 
       (${userId},'${userName}','${hashedPassword}',${age},'${location}','${emailId}','${phoneNumber}');`;
        await db.run(insertUserQuery);
        response.send("User created successfully");
      }
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { phoneNumber, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE phone_number = '${phoneNumber}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passMatch = await bcrypt.compare(password, dbUser.password);
    if (passMatch === true) {
      const payload = { username: phoneNumber };
      console.log(payload.username);
      const jwtToken = jwt.sign(payload, "SECRET");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api 3
const objToCam = (dbObject) => {
  return {
    gameId: dbObject.game_id,
    gameName: dbObject.game_name,
  };
};

app.get("/gamesList/", async (request, response) => {
  const getgameslist = `Select * from allgames;`;
  const list = await db.all(getgameslist);
  response.send(list.map((each) => objToCam(each)));
});

//api4
const objToCamel = (dbObject) => {
  return {
    gameId: dbObject.game_id,
    gameName: dbObject.g_name,
    userId: dbObject.user_id,
    win: dbObject.win,
  };
};

app.get("/aggregateScore/", async (request, response) => {
  const getAggregateScore = `select game_id,user_id,g_name,count(win) as win 
    from game where  win='true' group by game_id;`;
  const allscore = await db.all(getAggregateScore);
  response.send(allscore.map((each) => objToCamel(each)));
});

//api 5

const objToCame = (dbObject) => {
  return {
    userId: dbObject.user_id,
    gameId: dbObject.game_id,
    win: dbObject.win,
    totalPoints: dbObject.total_points,
  };
};

app.get("/game/:id", async (request, response) => {
  const { id } = request.params;
  const getgameId = `select game.user_id,game.game_id,count(win)as win,sum(points)as total_points from game inner join scores 
    on game.game_id = scores.game_id where game.game_id = ${id} group by game.user_id;`;
  const result = await db.all(getgameId);
  response.send(result.map((each) => objToCame(each)));
});

module.exports = app;

