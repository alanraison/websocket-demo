import {
  DeleteItemCommand,
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

interface WebsocketEvent {
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

const TableName = process.env.TABLE_NAME;
const ddb = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});
const eventBus = process.env.EVENT_BUS;

export async function disconnect(event: WebsocketEvent) {
  try {
    const { name, allPeople } = await deleteConnection(
      event.requestContext.connectionId
    );

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

async function deleteConnection(connectionId: string): Promise<Notification> {
  const result = await ddb.send(
    new DeleteItemCommand({
      TableName,
      Key: {
        PK: { S: `CONN#${connectionId}` },
      },
      ReturnValues: "ALL_OLD",
    })
  );
  const name = result.Attributes?.Name?.S;
  if (!name) {
    throw new Error("Couldn't find leaver");
  }
  const people = await ddb.send(
    new UpdateItemCommand({
      TableName,
      Key: { PK: { S: "ROOM" } },
      UpdateExpression: "Delete #people :person",
      ExpressionAttributeNames: {
        "#people": "People",
      },
      ExpressionAttributeValues: {
        ":person": { SS: [`${name}#${connectionId}`] },
      },
      ReturnValues: "ALL_NEW",
    })
  );
  return {
    name,
    allPeople:
      people.Attributes?.People?.SS?.map((p) => {
        const index = p.lastIndexOf("#");
        return {
          name: p.substring(0, index),
          connectionId: p.substr(index + 1),
        };
      }) || [],
  };
}

async function notify(notification: Notification) {
  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "websocket-demo",
          DetailType: "person-left",
          Detail: JSON.stringify(notification),
          EventBusName: eventBus,
        },
      ],
    })
  );
}
