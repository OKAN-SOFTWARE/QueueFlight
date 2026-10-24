// Copyright (c) 2026 OKAN TIKTAS. MIT License. Entirely fictional data.
export const DEMO = {Messages:[
 {MessageId:'demo-okan-001', Body:JSON.stringify({Type:'Notification',MessageId:'demo-sns-1',TopicArn:'arn:aws:sns:us-east-1:000000000000:demo-orders',Message:JSON.stringify({version:'0',source:'demo.orders','detail-type':'OrderCreated',detail:{orderId:'ORD-1042',customer:'Okan',total:49.99,currency:'USD',items:2}})}), Attributes:{ApproximateReceiveCount:'1',SentTimestamp:'1792828800000'}},
 {MessageId:'demo-phoenix-002', Body:JSON.stringify({orderId:'ORD-1043',customer:'Phoenix',total:29.5,currency:'USD',items:1}), Attributes:{ApproximateReceiveCount:'5',SentTimestamp:'1792828860000'}},
 {MessageId:'demo-mira-003', Body:JSON.stringify({orderId:'ORD-1044',customer:'Mira',total:'unknown',currency:'USD',items:3}), Attributes:{ApproximateReceiveCount:'7',SentTimestamp:'1792828920000'}},
 {MessageId:'demo-phoenix-004', Body:JSON.stringify({orderId:'ORD-1043',customer:'Phoenix',total:29.5,currency:'USD',items:1}), Attributes:{ApproximateReceiveCount:'2',SentTimestamp:'1792828980000'}},
 {MessageId:'demo-plain-005', Body:'warehouse notification: inventory sync queued', Attributes:{ApproximateReceiveCount:'1'}},
 {MessageId:'demo-okan-006', Body:JSON.stringify({orderId:'ORD-1042',customer:'Okan',total:59.99,currency:'USD',items:3}), Attributes:{ApproximateReceiveCount:'1',SentTimestamp:'1792829040000'}}
]};
