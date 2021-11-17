import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

interface WebsocketEvent {
  queryStringParameters: {
    [key: string]: string;
  };
  requestContext: {
    connectionId: string;
  };
}

interface PersonConnection {
  name: string;
  connectionId: string;
}

interface Notification {
  name: string;
  allPeople: Array<PersonConnection>;
}

if (!process.env.TABLE_NAME) {
  throw new Error("Initialisation error: TABLE_NAME not set");
}
if (!process.env.EVENT_BUS) {
  throw new Error("Initialisation error: EVENT_BUS not set");
}

const ddb = new DynamoDBClient({});
const TableName = process.env.TABLE_NAME as string;
const eventBridge = new EventBridgeClient({});
const eventBus = process.env.EVENT_BUS;

export async function connect(event: WebsocketEvent) {
  try {
    const connectionId = event.requestContext.connectionId;
    const name = "unknown";

    const allPeople = await saveConnection({ connectionId, name });

    await notify({ name, allPeople });

    return {
      statusCode: 204,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e instanceof Error ? e.message : e,
    };
  }
}

async function saveConnection({
  connectionId,
  name,
}: PersonConnection): Promise<Array<PersonConnection>> {
  await ddb.send(
    new PutItemCommand({
      TableName,
      Item: {
        PK: { S: `CONN#${connectionId}` },
        Name: { S: name },
      },
    })
  );
  const result = await ddb.send(
    new UpdateItemCommand({
      TableName,
      Key: {
        PK: { S: "ROOM" },
      },
      UpdateExpression: "Add #people :person",
      ExpressionAttributeNames: {
        "#people": "People",
      },
      ExpressionAttributeValues: {
        ":person": { SS: [`${name}#${connectionId}`] },
      },
      ReturnValues: "ALL_NEW",
    })
  );
  return (
    result.Attributes?.People?.SS?.map((p) => {
      const index = p.lastIndexOf("#");
      return {
        name: p.substring(0, index),
        connectionId: p.substr(index + 1),
      };
    }) || []
  );
}

async function notify(notification: Notification) {
  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "websocket-demo",
          DetailType: "person-joined",
          Detail: JSON.stringify(notification),
          EventBusName: eventBus,
        },
      ],
    })
  );
}
