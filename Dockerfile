FROM python
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SUPERUSER_USERNAME=myusername
ENV DJANGO_SUPERUSER_EMAIL=myemail@example.com
ENV DJANGO_SUPERUSER_PASSWORD=mypassword
WORKDIR /code
COPY requirements.txt /code/
RUN pip install -r requirements.txt --no-cache-dir
COPY . /code/
RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]