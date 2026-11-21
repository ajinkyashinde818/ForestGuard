import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
async function bootstrap(){const app=await NestFactory.create(AppModule); app.use(helmet()); app.enableCors({origin:(process.env.CORS_ORIGIN||'http://localhost:4200').split(','),credentials:true}); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true})); const doc=new DocumentBuilder().setTitle('ForestGuard API').setDescription('Forest monitoring API. AI reports possible sounds only; human verification is required.').setVersion('2.0').addBearerAuth().build(); SwaggerModule.setup('api/docs',app,SwaggerModule.createDocument(app,doc)); await app.listen(process.env.PORT||3000,'0.0.0.0');}
bootstrap();
