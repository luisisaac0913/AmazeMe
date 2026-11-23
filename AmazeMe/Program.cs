var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Resuelve rutas limpias sin extensión (.html) en local para coincidir con Cloudflare Pages
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value;
    if (!string.IsNullOrEmpty(path) && path != "/" && !Path.HasExtension(path))
    {
        var relativePath = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar) + ".html";
        var filePath = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", relativePath);
        if (File.Exists(filePath))
        {
            context.Request.Path = path + ".html";
        }
    }

    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles();

app.Run();
