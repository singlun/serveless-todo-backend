import * as AWS  from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { TodoItem } from '../models/TodoItem'
import { createLogger } from '../utils/logger'

const logger = createLogger('Todo DataAcess')
import Jimp from 'jimp/es';

export class TodoAccess {

  constructor(
    //Create a DynamoDB client
    private readonly docClient: DocumentClient = createDynamoDBClient(),

    //Retrieve the Evironment Variables For all the Resources    
    private readonly userIndex = process.env.USERID_INDEX,
    private readonly userTodosTable = process.env.USERS_TODO_TABLE,
    private readonly bucketName = process.env.TODOS_S3_BUCKET,
    private readonly expires = process.env.SIGNED_URL_EXPIRATION,        
    private readonly thumbnailBucketName = process.env.THUMBNAILS_S3_BUCKET,
    private readonly region = process.env.BUCKET_REGION
  ) {}

  async getUserTodos(userId: string): Promise<TodoItem[]> {

    var params = {
      TableName: this.userTodosTable,  
      IndexName: this.userIndex,
      KeyConditionExpression:  "userId = :userId",      
      ExpressionAttributeValues: {
          ":userId": userId,
      }
    };

    const result = await this.docClient.query(params).promise();
    const items = result.Items
    logger.info('getUserTodos', items)
    return items as TodoItem[]
  }  


  async createTodo(todo: TodoItem): Promise<TodoItem> {     

   const params = {
      TableName: this.userTodosTable,
      Item: todo
    }
    
    await this.docClient.put(params).promise();

    return todo
  }

  async deleteUserTodo(todoId: string, userId: string) { 
    
    
    //Parameters For deleting the User Todo'S Records.
    var params = {
      TableName:this.userTodosTable,
      Key:{
          "userId": userId,
          "todoId": todoId        
      }
    };

    await this.docClient.delete(params).promise();

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


  async updateUserTodo(todo: TodoItem): Promise<string> {

    var params = {
      TableName: this.userTodosTable,
      Key: { userId : todo.userId, todoId : todo.todoId},
      UpdateExpression: 'set #name = :x , dueDate = :u , done = :d ',
      ExpressionAttributeNames: {'#name' : 'name'},
      ExpressionAttributeValues: {
        ':x' : todo.name,
        ':u' : todo.dueDate,
        ':d' : todo.done,
      },
      ReturnValues: "ALL_NEW"
    };
    
   let documentClient = new AWS.DynamoDB.DocumentClient();

   const promise =  new Promise( function(resolve, reject) {
                        documentClient.update(params, function(err, data) {
                          if (err) {
                              console.log(err);
                              reject(JSON.stringify({error: err.message}));
                          }
                          else { 
                              console.log("Todo Item Successfully commited", data);
                              resolve(JSON.stringify(data));
                          }
                        }); 
                    });

    const updateItem: any = await promise;

    return updateItem;

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

