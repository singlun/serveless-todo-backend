import 'source-map-support/register'
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { createLogger } from '../../utils/logger'
import { updateUserTodo } from '../../businessLogic/todo'
import { TodoUpdate } from '../../models/TodoUpdate'
import { TodoItem } from '../../models/TodoItem'
import { parseUserId } from '../../auth/utils'


const logger = createLogger('deleteTodo')

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  logger.info('Event Processing', {event: event.body})
  //Extract JWT Token From the Authoriztion Header
  const authorization = event.headers.Authorization
  const split = authorization.split(' ')
  const jwtToken = split[1]
  const todoUpdate: TodoUpdate = JSON.parse(event.body)
  const thumbnailBucketName = process.env.THUMBNAILS_S3_BUCKET

  //Get the TodoId From the Query String
  const todoId = event.pathParameters.todoId

  //Extract the UserId From the jwt Token
  const userId = parseUserId(jwtToken)

  const updateItem: string = await updateUserTodo({
                        userId,
                        todoId,
                        createdAt: new Date().toISOString(),
                        name: todoUpdate.name,
                        dueDate: todoUpdate.dueDate,
                        done: todoUpdate.done,
                        attachmentUrl: `https://${thumbnailBucketName}.s3.amazonaws.com/${todoId}.jpeg`,
                    });


  let items = JSON.parse(updateItem)

  logger.info('User Todo items', items)                                      

  // Return the Updated Item Result back to the Client                        
  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
    },
    body: JSON.stringify({items})
  }
}
