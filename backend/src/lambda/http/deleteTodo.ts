import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda'
import { deleteUserTodos } from '../../businessLogic/todo'
import { createLogger } from '../../utils/logger'

const logger = createLogger('deleteTodo')

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

  logger.info('Event Processing', {event: event.body})

  //Get the TodoId From the Query String
  const todoId = event.pathParameters.todoId

  
  logger.info('User Todoid', {toId: todoId})

  //Delete User's Todo Item
  await deleteUserTodos(todoId)

  // Return the New Item Result back to the Client
  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
    },
    body: JSON.stringify({
      item: {}
    })
  }
}
