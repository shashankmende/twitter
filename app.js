const express = require("express");
const app = express();
app.use(express.json());
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at http://localhost:3000");
    });
  } catch (e) {
    console.log(`db error :${e.message}`);
    process.exit(1);
  }
};
initializeDb();

const Authenticate = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "secretkey", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

const middleware2 = async (request, response, next) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userFollowingListQuery = `
        select following_user_id from user inner join 
        follower on user.user_id = follower.follower_user_id
        where username = '${username}';
    `;
  const followingListResult = await db.all(userFollowingListQuery);
  const followingList = followingListResult.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const gettingUserIdQuery = `
  select user_id from  tweet 
  where tweet_id = ${tweetId}
  
  `;
  const userIdFromTweet = await db.get(gettingUserIdQuery);
  console.log(userIdFromTweet);
  const userIds = (eachUser) => {
    return eachUser.user_id;
  };

  const isUserFollowing = followingList.includes(userIds(userIdFromTweet));
  console.log(isUserFollowing);
  if (!isUserFollowing) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  let selectUserQuery = `
    select * from user 
    where username like '${username}'    
    `;
  const user = await db.get(selectUserQuery);
  console.log(user);
  if (user === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    //create new user
    const lengthOfPassword = password.length;
    if (lengthOfPassword < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const insertQuery = `
            insert into user ( name, username,password,gender)
            values(
                '${name}',
                '${username}',
                '${hashedPassword}',
                '${gender}');                
        `;
      await db.run(insertQuery);
      response.send("User created successfully");
    }
  } else {
    //user already exitst
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);
  selectUserQuery = `
    select * from user 
    where username like '${username}'    
    `;
  const user = await db.get(selectUserQuery);
  console.log(user);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "secretkey");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/login/", Authenticate, async (request, response) => {
  const getAllUsers = `
        select * from user;
    `;
  const users = await db.all(getAllUsers);
  response.send(users);
});

app.get("/user/tweets/feed/", Authenticate, async (request, response) => {
  const { username } = request;
  console.log(username);
  const user_id_query = `
    select *  from user where username = '${username}'
  
  `;
  const db_user_id = await db.get(user_id_query);
  const followingUserId = `
    select  user.username,tweet , date_time as dateTime from follower inner join tweet on
    follower.following_user_id = tweet.user_id inner join user on user.user_id
    = tweet.user_id
    where follower.follower_user_id = ${db_user_id.user_id}
    order by date_time desc
    limit 4
    offset 0
  `;
  const result = await db.all(followingUserId);
  response.send(result);
});

app.get("/user/following/", Authenticate, async (request, response) => {
  const { username } = request;
  const following_ids = `
        select following_user_id from user inner join 
        follower on user.user_id = follower.follower_user_id
        where user.username = '${username}'
    
    `;
  const user = await db.all(following_ids);

  const listOfUserIds = user.map((each_user) => {
    return each_user.following_user_id;
  });

  const queryFunction = async (userId) => {
    const query = `
            select name from user 
            where user_id = ${userId}
        
        `;
    const queryResult = await db.get(query);
    return queryResult;
  };

  resultList = [];
  for (let eachUser of listOfUserIds) {
    const user = await queryFunction(eachUser);

    resultList.push(user);
  }
  response.send(resultList);
  //response.send(result);
});

app.get("/user/followers/", Authenticate, async (request, response) => {
  const { username } = request;
  const findingFollowersIds = `
        select follower_user_id from user inner join follower
        on user.user_id = follower.following_user_id
        where username = '${username}'
     
     `;
  const followersList = await db.all(findingFollowersIds);
  console.log(followersList);
  const ListOfIds = followersList.map((eachUser) => {
    return eachUser.follower_user_id;
  });

  const queryFunction = async (userId) => {
    const query = `
            select name from user 
            where user_id = ${userId}
        
        `;
    const queryResult = await db.get(query);
    return queryResult;
  };

  resultList = [];
  for (let eachUser of ListOfIds) {
    const user = await queryFunction(eachUser);

    resultList.push(user);
  }
  response.send(resultList);
});

app.get(
  "/tweets/:tweetId/",
  Authenticate,
  middleware2,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const joinTweetAndReplyQuery = `
      select tweet,count() as replies,date_time as dateTime
      from tweet inner join reply
      on tweet.tweet_id = reply.tweet_id
      where tweet.tweet_id = ${tweetId}
      `;
    const resultFromTRJoin = await db.get(joinTweetAndReplyQuery);
    // console.log(resultFromTRJoin);
    const joinTweetAndLike = `
    select count() as likes from tweet inner join like
    on tweet.tweet_id = like.tweet_id
    where tweet.tweet_id = ${tweetId}    
    `;
    const resultFromTLjoin = await db.get(joinTweetAndLike);
    // console.log(resultFromTLjoin);
    resultFromTRJoin.likes = resultFromTLjoin.likes;
    response.send(resultFromTRJoin);
  }
);

app.get(
  "/tweets/:tweetId/likes/",
  Authenticate,
  middleware2,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getUsersFromLike = `
        select user_id from like
        where tweet_id = ${tweetId}
    
    `;
    const userIdsfromLikeResult = await db.all(getUsersFromLike);
    console.log(userIdsfromLikeResult);
    userIdsfromLike = userIdsfromLikeResult.map((eachId) => {
      return eachId.user_id;
    });
    console.log(userIdsfromLike);
    const resultList = [];
    const getOutputFunction = async (userId) => {
      const query = `
            select username from user
            where user_id = ${userId}
            `;
      const result = await db.get(query);
      //
      return result;
    };

    for (let eachuser of userIdsfromLike) {
      output = await getOutputFunction(eachuser);
      resultList.push(output);
    }
    console.log(resultList);
    output = resultList.map((eachitem) => {
      return eachitem.username;
    });
    console.log(output);
    response.send({ likes: output });
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  Authenticate,
  middleware2,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `
    
    select user.name,reply.reply
    from reply inner join user on
    reply.user_id = user.user_id
    where reply.tweet_id = ${tweetId}
    
    `;
    const listOfReplies = await db.all(query);
    console.log(listOfReplies);
    response.send({
      replies: listOfReplies,
    });
  }
);
let index = 0;

app.get("/user/tweets/", Authenticate, async (request, response) => {
  const myTweets = await db.all(`
    select 
    tweet.tweet,
    count(distinct like.like_id) as likes,
    count(distinct reply.reply_id) as replies,
    tweet.date_time
    from 
    tweet
    left join like on tweet.tweet_id = like.tweet_id
    left join reply on tweet.tweet_id = reply.tweet_id
    where tweet.user_id = (select user_id from user where username = '${request.username}')
    group by tweet.tweet_id;    
    
    `);
  response.send(
    myTweets.map((item) => {
      const { date_time, ...rest } = item;
      return { ...rest, dateTime: date_time };
    })
  );
});

app.post("/user/tweets/", Authenticate, async (request, response) => {
  const { tweet } = request.body;
  const insertQuery = `
  
  insert into tweet ( tweet )
  values('${tweet}')
  
  `;
  await db.run(insertQuery);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/", Authenticate, async (request, response) => {
  const { tweetId } = request.params;
  console.log(typeof tweetId);
  const { username } = request;
  console.log(username);

  const gettingUserIdsFromUser = `
  
  select user_id from user
  where username = '${username}'
  `;
  const userId = await db.get(gettingUserIdsFromUser);

  console.log(userId);
  const getTweetIdsofUser = `
  
  select tweet_id from tweet where
  user_id = ${userId.user_id}

  `;
  const userIdsResult = await db.all(getTweetIdsofUser);
  console.log(userIdsResult);
  const userIds = userIdsResult.map((eachId) => {
    return eachId.tweet_id;
  });
  console.log(userIds);
  const isTweetIdBelongsToUser = userIds.includes(parseInt(tweetId));
  console.log(isTweetIdBelongsToUser);
  //console.log(tweetId);

  if (isTweetIdBelongsToUser) {
    //delete Tweet
    const intTweetId = parseInt(tweetId);
    const deleteQuery = `
    
    delete from tweet where tweet_id = ${intTweetId}
    
    `;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
