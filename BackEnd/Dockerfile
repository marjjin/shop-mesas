FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["GestionMesas.Api.csproj", "./"]
RUN dotnet restore "GestionMesas.Api.csproj"
COPY . .
RUN dotnet publish "GestionMesas.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:$PORT
ENTRYPOINT ["dotnet", "GestionMesas.Api.dll"]