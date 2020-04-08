import * as AWS  from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { TodoItem } from '../models/TodoItem'
import { TodoUpdate } from '../models/TodoUpdate'
import { createLogger } from '../utils/logger'

const logger = createLogger('Todo DataAcess')
import Jimp from 'jimp/es';

export class TodoAccess {

  constructor(
    //Create a DynamoDB client
    private readonly docClient: DocumentClient = createDynamoDBClient(),

    //Retrieve the Evironment Variables For all the Resources
    private readonly usersTable = process.env.USERS_TABLE,
    private readonly todosTable = process.env.TODOS_TABLE,
    private readonly userIndex = process.env.USERID_INDEX,
    private readonly userTodosTable = process.env.USERS_TODO_TABLE,
    private readonly bucketName = process.env.TODOS_S3_BUCKET,
    private readonly expires = process.env.SIGNED_URL_EXPIRATION,        
    private readonly thumbnailBucketName = process.env.THUMBNAILS_S3_BUCKET,
    private readonly region = process.env.BUCKET_REGION
  ) {}

  async getUserTodos(userId: string): Promise<TodoItem[]> {

    //Query method to search for items. 
    var params = {
      TableName: this.usersTable,
      IndexName: this.userIndex,
      ProjectionExpression: "userId, todoId,  createdAt, #name, dueDate, done, attachmentUrl",
      KeyConditionExpression:  "userId = :userId", 
      ExpressionAttributeNames:{
        "#name": "name"
      },         
      ExpressionAttributeValues: {
          ":userId": userId
      }
    };

    //Query the Todos Records From the dynamoDb.
    //Please note that query is used because the a Global index
    //is applied to the users Table.    
    const result = await this.docClient.query(params).promise();
    const items = result.Items
    logger.info('getUserTodos', JSON.parse(JSON.stringify(result.Items)))
    return items as TodoItem[]
  }  


  async createTodo(todo: TodoItem): Promise<TodoItem> {

    await this.docClient.put({
      TableName: this.usersTable,
      Item: todo
    }).promise()     
    
    await this.docClient.put({
      TableName: this.todosTable,
      Item: todo
    }).promise() 

    await this.docClient.put({
      TableName: this.userTodosTable,
      Item: todo
    }).promise()    

    return todo
  }

  async deleteUserTodo(todoId: string) {

    var paramsUser = {
      TableName: this.todosTable,
      Key: {
        'todoId': {todoId: todoId}
      },
      ProjectionExpression: 'todoId'
    };    

    const result = await this.docClient.get(paramsUser).promise();
    const user = JSON.parse(JSON.stringify(result.Item))      

    //Parameters For deleting the User Todo'S Records.
    var params = {
      TableName:this.userTodosTable,
      Key:{
          "userId": {userId: user.userId},
          "todoId": {todoId: todoId}         
      }
    };

    await this.docClient.delete(params).promise();

    var params2 = {
      TableName:this.todosTable,
      Key:{
          "todoId": {todoId: todoId}         
      }
    };

    await this.docClient.delete(params2).promise();

    var params3 = {
      TableName:this.usersTable,
      Key:{
          "userId": {userId: user.userId},       
      }
    };

    await this.docClient.delete(params3).promise();    

  }

  async attachTodoUrl(uploadUrl: string, todoId: string) {

    var paramsUser = {
      TableName: this.todosTable,
      Key: {
        'todoId': {todoId: todoId}
      },
      ProjectionExpression: 'todoId'
    };    

    const result = await this.docClient.get(paramsUser).promise();
    const user = JSON.parse(JSON.stringify(result.Item))   

    const params = {
      TableName: this.userTodosTable,
      Key:{
        "userId": {userId: user.userId},
        "todoId": todoId 
      },
      UpdateExpression: "set attachmentUrl = :r",     
      ExpressionAttributeValues:{
          ":userId":user,
          ":todoId":todoId,
          ":r":uploadUrl
      },
    };

    await this.docClient.update(params).promise();


    const params2 = {
      TableName: this.todosTable,
      Key:{
          "todoId": {todoId: todoId}
      },
      UpdateExpression: "set attachmentUrl = :r",     
      ExpressionAttributeValues:{
          ":r":uploadUrl
      },
    };

    await this.docClient.update(params2).promise();  
    
    const params3 = {
      TableName: this.usersTable,
      Key:{
          "userId": {userId: user.userId}
      },
      UpdateExpression: "set attachmentUrl = :r",     
      ExpressionAttributeValues:{
          ":r":uploadUrl
      },
    };

    await this.docClient.update(params3).promise();     
 
  }


  getUploadUrl(todoId: string): string {

    //This part generates the presigned URL for the S3 Bucket.
    const s3 = new AWS.S3({
      region: this.region,
      params: {Bucket: this.bucketName}
    });    

    var params = {Bucket: this.bucketName, Key: todoId, Expires: parseInt(this.expires)};

    logger.info('UrlUpload Param', params)
    
    return s3.getSignedUrl('putObject', params)
 
  }


  async updateUserTodo(todo: TodoUpdate, todoId: string) {

    var paramsUser = {
      TableName: this.todosTable,
      Key: {
        'todoId': {todoId: todoId}
      },
      ProjectionExpression: 'todoId'
    };    

    const result = await this.docClient.get(paramsUser).promise();
    const user = JSON.parse(JSON.stringify(result.Item))    

    // Parameters setting for Updating User's Todo Item.
    const params = {
      TableName: this.userTodosTable,
      Key:{
        "userId": {userId: user.UserId},
        "todoId": {todoId: todoId},
      },
      UpdateExpression: "set #name = :r, dueDate=:p, done=:a",
      ExpressionAttributeNames:{
        "#name": "name"
      },       
      ExpressionAttributeValues:{
          ":r":todo.name,
          ":p":todo.dueDate,
          ":a":todo.done
      },
    };


    await this.docClient.update(params).promise();


    const params2 = {
      TableName: this.todosTable,
      Key:{
          "todoId": {todoId: todoId}
      },
      UpdateExpression: "set #name = :r, dueDate=:p, done=:a",
      ExpressionAttributeNames:{
        "#name": "name"
      },       
      ExpressionAttributeValues:{
          ":r":todo.name,
          ":p":todo.dueDate,
          ":a":todo.done
      },
    };

    await this.docClient.update(params2).promise();   
    
    const params3 = {
      TableName: this.usersTable,
      Key:{
          "userId": {userId: user.userId}
      },
      UpdateExpression: "set #name = :r, dueDate=:p, done=:a",
      ExpressionAttributeNames:{
        "#name": "name"
      },       
      ExpressionAttributeValues:{
          ":r":todo.name,
          ":p":todo.dueDate,
          ":a":todo.done
      },
    };

    await this.docClient.update(params3).promise();      

  }

  async processTodoImage(key: string) {

    logger.info('Processing S3 item with key: ', {key})

    //This retrieve the image from the S3 bucket.
    
    const s3 = new AWS.S3({
      region: this.region,
      params: {Bucket: this.bucketName}
    });  
  
    //The image retrieve is a image Buffer.
    const response = await s3
      .getObject({
        Bucket: this.bucketName,
        Key: key
      })
      .promise()  
  
    const body: any = response.Body
    const image = await Jimp.read(body)
  
    logger.info('Buffer',{imageBuffer: image})
  
    image.resize(150, Jimp.AUTO)
    const convertedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG)
  
    logger.info('Writing image back to S3 bucket', {bucket: this.thumbnailBucketName})
    await s3
      .putObject({
        Bucket: this.thumbnailBucketName,
        Key: `${key}.jpeg`,
        Body: convertedBuffer
      })
      .promise()
  
  }
  }

function createDynamoDBClient() {

  return new AWS.DynamoDB.DocumentClient()

}

