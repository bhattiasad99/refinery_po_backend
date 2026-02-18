---
to: <%= name %>/.env
---
PORT=<%= port %>
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require&channel_binding=require'
EVENT_BUS_URL='http://localhost:8001'
INTERNAL_SERVICE_KEY='refinery-local-key'
